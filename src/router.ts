import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from './pages/Home.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})
