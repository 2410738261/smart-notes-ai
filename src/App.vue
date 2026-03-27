<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { supabase } from './supabase'

/** ---------- State ---------- */
const email = ref('')
const password = ref('')

const session = ref(null)
const loading = ref(false)
const errorMsg = ref('')

const notes = ref([])
const title = ref('')
const content = ref('')
const tagsInput = ref('')

const isLoggedIn = computed(() => !!session.value?.user)
const userEmail = computed(() => session.value?.user?.email ?? '')
const userId = computed(() => session.value?.user?.id ?? '')

let authSubscription = null

/** ---------- Helpers ---------- */
function setError(e) {
  if (!e) return
  // Supabase errors sometimes have message, sometimes string
  errorMsg.value = typeof e === 'string' ? e : (e.message || JSON.stringify(e))
}

function clearError() {
  errorMsg.value = ''
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

function parseTags(str) {
  const t = (str || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  return t.length ? t : null
}

/** ---------- Auth ---------- */
async function loadSession() {
  clearError()
  const { data, error } = await supabase.auth.getSession()
  if (error) setError(error)
  session.value = data?.session ?? null
}

async function signUp() {
  clearError()
  loading.value = true
  try {
    const { error } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value
    })
    if (error) throw error

    // Hinweis: falls Email Confirm aktiv ist, muss User bestätigen
    alert(
      'Sign-up erfolgreich. Falls E-Mail-Bestätigung aktiv ist: bitte Mail bestätigen, dann einloggen.'
    )
  } catch (e) {
    setError(e)
  } finally {
    loading.value = false
  }
}

async function signIn() {
  clearError()
  loading.value = true
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value
    })
    if (error) throw error
    // Session kommt via onAuthStateChange, aber wir sind robust:
    await loadSession()
    await loadNotes()
  } catch (e) {
    setError(e)
  } finally {
    loading.value = false
  }
}

async function signOut() {
  clearError()
  loading.value = true
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    session.value = null
    notes.value = []
  } catch (e) {
    setError(e)
  } finally {
    loading.value = false
  }
}

/** ---------- Notes ---------- */
async function loadNotes() {
  if (!isLoggedIn.value) return
  clearError()
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    notes.value = data ?? []
  } catch (e) {
    setError(e)
  } finally {
    loading.value = false
  }
}

/** ---------- AI Title (Edge Function) ---------- */
/**
 * Erwartet: Supabase Edge Function "ai-title"
 * Rückgabe: { title: "..." }
 * Falls nicht vorhanden / Fehler: gibt '' zurück
 */
async function generateTitleWithAI(noteContent) {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Call
  const call = supabase.functions.invoke("ai-title", {
    body: { content: noteContent },
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  }).then(({ data, error }) => {
    if (error || data?.error) return ""
    return (data?.title ?? "").trim()
  }).catch(() => "")

  // Timeout nach 6 Sekunden: kein Hängen mehr
  const timeout = new Promise(resolve => setTimeout(() => resolve(""), 6000))

  return await Promise.race([call, timeout])
}

async function createNote() {
  if (!isLoggedIn.value) return
  if (!content.value.trim()) {
    setError('Content ist Pflicht.')
    return
  }

  clearError()
  loading.value = true

  try {
    // 1) AI Titel (Pflichtteil) – aber wir lassen den Save nicht scheitern
    const aiTitle = await generateTitleWithAI(content.value)

    // 2) finaler Titel: manuell > ai > fallback
    const finalTitle = (title.value.trim() || aiTitle || 'Untitled').trim()

    // 3) Tags: optional
    const tags = parseTags(tagsInput.value)

    // 4) Insert
    const { error } = await supabase.from('notes').insert({
      user_id: userId.value,
      title: finalTitle,
      content: content.value,
      tags
    })

    if (error) throw error

    // reset
    title.value = ''
    content.value = ''
    tagsInput.value = ''

    await loadNotes()
  } catch (e) {
    setError(e)
  } finally {
    loading.value = false
  }
}

/** ---------- Lifecycle ---------- */
onMounted(async () => {
  await loadSession()

  // Auth State Change (robust + auto refresh)
  const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
    session.value = newSession
    if (newSession) {
      await loadNotes()
    } else {
      notes.value = []
    }
  })

  authSubscription = data?.subscription ?? null

  // Wenn schon eingeloggt: Notes laden
  if (isLoggedIn.value) {
    await loadNotes()
  }
})

onBeforeUnmount(() => {
  authSubscription?.unsubscribe?.()
})
</script>

<template>
  <main class="wrap">
    <header class="header">
      <h1>Smart Notes</h1>
      <p class="sub">
        Vue + Supabase + AI (Titelgenerierung)
      </p>
    </header>

    <section v-if="errorMsg" class="error">
      <strong>Fehler:</strong> {{ errorMsg }}
      <button class="link" @click="errorMsg = ''">schließen</button>
    </section>

    <!-- LOGIN -->
    <section v-if="!isLoggedIn" class="card">
      <h2>Login</h2>

      <label class="label">E-Mail</label>
      <input class="input" v-model="email" placeholder="name@example.com" />

      <label class="label">Passwort</label>
      <input class="input" v-model="password" type="password" placeholder="••••••••" />

      <div class="row">
        <button class="btn" :disabled="loading" @click="signIn">
          {{ loading ? '...' : 'Sign In' }}
        </button>
        <button class="btn secondary" :disabled="loading" @click="signUp">
          {{ loading ? '...' : 'Sign Up' }}
        </button>
      </div>

      <p class="hint">
        Hinweis: Wenn Supabase „Confirm email“ aktiv hat, musst du nach Sign Up die Bestätigungsmail klicken.
      </p>
    </section>

    <!-- APP -->
    <section v-else class="card">
      <div class="row space">
        <div>
          <div class="small">Angemeldet als</div>
          <div><strong>{{ userEmail }}</strong></div>
        </div>
        <div class="row">
          <button class="btn secondary" :disabled="loading" @click="loadNotes">Reload</button>
          <button class="btn" :disabled="loading" @click="signOut">Logout</button>
        </div>
      </div>

      <hr class="hr" />

      <h2>Neue Notiz</h2>

      <label class="label">Titel (optional – AI kann generieren)</label>
      <input class="input" v-model="title" placeholder="Optionaler Titel" />

      <label class="label">Inhalt (Pflicht)</label>
      <textarea class="textarea" v-model="content" rows="6" placeholder="Schreibe deine Notiz..."></textarea>

      <label class="label">Tags (optional, Komma-separiert)</label>
      <input class="input" v-model="tagsInput" placeholder="z.B. uni, cloud, todo" />

      <div class="row">
        <button class="btn" :disabled="loading" @click="createNote">
          {{ loading ? 'Speichere...' : 'Speichern (mit AI Titel)' }}
        </button>
      </div>

      <hr class="hr" />

      <h2>Deine Notizen</h2>

      <div v-if="notes.length === 0" class="hint">
        Noch keine Notizen vorhanden.
      </div>

      <ul class="list" v-else>
        <li v-for="n in notes" :key="n.id" class="note">
          <div class="noteHead">
            <div class="noteTitle">{{ n.title || '(kein Titel)' }}</div>
            <div class="noteDate">{{ formatDate(n.created_at) }}</div>
          </div>
          <div class="noteBody">{{ n.content }}</div>
          <div v-if="n.tags?.length" class="noteTags">
            Tags: <span v-for="t in n.tags" :key="t" class="tag">{{ t }}</span>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.wrap { max-width: 820px; margin: 0 auto; padding: 24px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; }
.header { margin-bottom: 16px; }
.sub { margin-top: 4px; opacity: .75; }

.card { background: #fff; border: 1px solid #e7e7e7; border-radius: 14px; padding: 16px; box-shadow: 0 2px 10px rgba(0,0,0,.04); }
.hr { border: 0; border-top: 1px solid #eee; margin: 16px 0; }

.label { display: block; margin: 10px 0 6px; font-size: 14px; opacity: .85; }
.input, .textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 10px; font-size: 14px; outline: none; }
.textarea { resize: vertical; }

.row { display: flex; gap: 10px; margin-top: 12px; align-items: center; }
.space { justify-content: space-between; }

.btn { background: #111827; color: white; border: 0; padding: 10px 12px; border-radius: 10px; cursor: pointer; font-weight: 600; }
.btn.secondary { background: #eef2ff; color: #111827; }
.btn:disabled { opacity: .6; cursor: not-allowed; }

.hint { margin-top: 10px; opacity: .75; font-size: 14px; }

.error { margin: 12px 0; padding: 12px; border-radius: 12px; background: #fff5f5; border: 1px solid #ffd2d2; color: #7a0b0b; display:flex; gap:10px; align-items:center; justify-content:space-between; }
.link { background: transparent; border: 0; color: inherit; text-decoration: underline; cursor: pointer; }

.list { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.note { border: 1px solid #eee; border-radius: 14px; padding: 12px; background: #fafafa; }
.noteHead { display:flex; justify-content: space-between; gap: 10px; align-items: baseline; }
.noteTitle { font-weight: 800; }
.noteDate { opacity: .7; font-size: 13px; }
.noteBody { margin-top: 8px; white-space: pre-wrap; }
.noteTags { margin-top: 8px; opacity: .85; font-size: 13px; display:flex; gap:6px; flex-wrap: wrap; align-items:center; }
.tag { background:#e0f2fe; padding: 3px 8px; border-radius: 999px; }
.small { font-size: 12px; opacity: .7; }
</style>