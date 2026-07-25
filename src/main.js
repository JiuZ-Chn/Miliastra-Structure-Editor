import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { resizableColumns } from './directives/resizableColumns.js'
import './style.css'

createApp(App)
	.use(createPinia())
	.directive('resizable-columns', resizableColumns)
	.mount('#app')
