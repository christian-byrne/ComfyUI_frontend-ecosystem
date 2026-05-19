import { createHead } from '@unhead/vue/client'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { router } from './router'
import './styles/main.css'

const app = createApp(App)
const head = createHead()
app.use(createPinia())
app.use(head)
app.use(router)

if (import.meta.env.DEV) {
  import('vue-axe').then(({ default: VueAxe }) => {
    app.use(VueAxe)
  })
}

app.mount('#app')
