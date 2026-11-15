export default function CartaNoEncontrada() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-bold">Carta no disponible</h1>
      <p className="text-neutral-600">
        Esta carta no existe o el restaurante todavía no la ha publicado. Pregunta al personal.
      </p>
    </main>
  );
}
