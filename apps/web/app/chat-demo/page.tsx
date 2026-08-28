export default function ChatDemoPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-2xl font-bold">Chatbot de reservas</h1>
      <p className="mb-4 text-gray-600">
        El widget flotante abajo a la derecha es el chatbot. Escribí &ldquo;Hola&rdquo; para
        empezar a reservar una cancha. El widget aparece en todo el sitio.
      </p>
      <ul className="list-inside list-disc text-sm text-gray-600">
        <li>Elegí una cancha y un horario disponible.</li>
        <li>Elegí pagar en línea o en sede.</li>
        <li>Si pagás en línea, completás el pago en la pasarela (simulada en desarrollo).</li>
      </ul>
    </main>
  );
}
