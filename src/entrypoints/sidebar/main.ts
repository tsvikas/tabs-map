import { mount } from 'svelte';
import Sidebar from './Sidebar.svelte';
import './style.css';

const app = mount(Sidebar, {
  target: document.getElementById('app')!,
});

export default app;
