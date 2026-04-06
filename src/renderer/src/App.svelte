<script lang="ts">
  let greeting = $state('Store Playground')
</script>

<main>
  <h1>{greeting}</h1>
  <p>Electron + Svelte 5 scaffolding complete.</p>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  h1 {
    font-size: 2.5rem;
    color: #1a1a1a;
    margin-bottom: 0.5rem;
  }

  p {
    color: #666;
    font-size: 1.1rem;
  }
</style>
