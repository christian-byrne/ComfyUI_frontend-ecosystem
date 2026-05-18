import { createPinia } from "pinia";
import { createHead } from "@unhead/vue/client";
import { createApp } from "vue";

import App from "./App.vue";
import { router } from "./router";
import "./styles/main.css";

const app = createApp(App);
const head = createHead();
app.use(createPinia());
app.use(head);
app.use(router);
app.mount("#app");
