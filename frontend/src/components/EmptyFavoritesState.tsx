function EmptyFavoritesState() {
  return (
    <div className="favorites-empty" role="status">
      <h2>Aún no tienes favoritos</h2>
      <p>Guarda los inmuebles que te interesen pulsando el corazón para volver a ellos más tarde.</p>
      <a className="button button--accent" href="/">
        Explorar inmuebles
      </a>
    </div>
  );
}

export default EmptyFavoritesState;
