<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './supabase'

// Login-Daten
const email = ref('')
const password = ref('')

// Session (eingeloggt / ausgeloggt)
const session = ref(null)

// Notes
const content = ref('')
const notes = ref([])

// Beim Start prüfen, ob bereits eingeloggt
onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  session.value = data.session

  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
    if (newSession) loadNotes()
  })

  if (session.value) loadNotes()
})

// Registrierung
async function signUp() {
  const { error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value
  })
  if (error) alert(error.message)
  else alert('Registrierung erfolgreich – bitte einloggen.')
}

// Login
async function signIn() {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })
  if (error) alert(error.message)
}

// Logout
async function signOut() {
  await supabase.auth.signOut()
  notes.value = []
}

// Notes laden
async function loadNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) alert(error.message)
  notes.value = data ?? []
}

// Note speichern (noch OHNE AI)
async function createNote() {
  if (!content.value.trim()) return alert('Inhalt ist Pflicht')

  const userId = session.value.user.id

  const { error } = await supabase.from('notes').insert({
    user_id: userId,
    title: '(ohne AI Titel)',
    content: content.value
  })

  if (error) alert(error.message)

  content.value = ''
  await loadNotes()
}
</script>

<template>
  <main style="max-width:720px;margin:0 auto;padding:24px;font-family:system-ui;">
    <h1>Smart Notes</h1>

    <!-- LOGIN -->
    <section v-if="!session">
      <h2>Login</h2>
      <input v-model="email" placeholder="E-Mail"
             style="display:block;width:100%;margin:8px 0;padding:8px;">
      <input v-model="password" type="password" placeholder="Passwort"
             style="display:block;width:100%;margin:8px 0;padding:8px;">
      <button @click="signIn" style="margin-right:8px;">Login</button>
      <button @click="signUp">Registrieren</button>
    </section>

    <!-- APP -->
    <section v-else>
      <div style="display:flex;justify-content:space-between;">
        <p>Angemeldet als <b>{{ session.user.email }}</b></p>
        <button @click="signOut">Logout</button>
      </div>

      <hr>

      <h2>Neue Notiz</h2>
      <textarea v-model="content" rows="6"
        placeholder="Notizinhalt"
        style="display:block;width:100%;margin:8px 0;padding:8px;">
      </textarea>
      <button @click="createNote">Speichern (noch ohne AI)</button>

      <hr>

      <h2>Meine Notizen</h2>
      <div v-if="notes.length === 0">Noch keine Notizen.</div>

      <ul>
        <li v-for="n in notes" :key="n.id" style="margin:12px 0;">
          <b>{{ n.title }}</b><br>
          <small>{{ new Date(n.created_at).toLocaleString() }}</small>
          <div style="white-space:pre-wrap;">{{ n.content }}</div>
        </li>
      </ul>
    </section>
  </main>
</template>