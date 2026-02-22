import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/collection/:collection/',
      children: [
        {
          path: '',
          name: 'collection',
          props: true,
          component: () => import('../views/CollectionView.vue'),
        },
        {
          path: 'tsumego/:tsumego/',
          name: 'tsumego',
          props: true,
          component: () => import('../views/TsumegoView.vue'),
        },
        {
          path: 'explore/',
          name: 'explore',
          props: true,
          component: () => import('../views/ExploreView.vue'),
        },
      ],
    },
  ],
})

export default router
