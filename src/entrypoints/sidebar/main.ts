import Sidebar from './Sidebar.svelte';
import './style.css';

const app = new Sidebar({
  target: document.getElementById('app')!,
});

export default app;
