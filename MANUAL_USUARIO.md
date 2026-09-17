# Manual de Usuario — Panel Administrativo Pro Futbol Antigua

Esta guía es para el personal que usa el sistema todos los días: recepción,
administración y entrenadores. No necesitás saber nada de programación para
usar esta guía.

---

## Cómo entrar al sistema

1. Abrí el navegador (Chrome, o el que uses normalmente) en tu celular o
   computadora.
2. Andá a la dirección que te dio el equipo técnico (por ejemplo,
   `www.profutbolantigua.com/login`).
3. Escribí tu correo y contraseña, y tocá "Ingresar".

Si olvidaste tu contraseña, pedile a un administrador que te ayude a
restablecerla (todavía no hay un botón de "olvidé mi contraseña" en el panel
— se resuelve directamente con el equipo técnico, que puede hacerlo por el
endpoint de cambio de contraseña).

**Recomendación:** cuando te den tu contraseña inicial, cambiála por una que
solo vos conozcas (puede hacerlo un administrador por el endpoint
`PATCH /auth/password`, que exige la contraseña actual antes de aceptar la
nueva).

---

## Reservas

### Ver las reservas del día

1. Entrá a la pestaña **Reservas** (es la pantalla que aparece al iniciar sesión).
2. Arriba a la derecha podés elegir la fecha que querés ver.
3. Cada fila muestra: horario, cancha, nombre y teléfono del cliente,
   precio, y el estado de la reserva:
   - 🟡 **Pendiente de pago** — el cliente eligió pagar en línea pero
     todavía no completó el pago.
   - 🔵 **Pendiente en sede** — el cliente va a pagar al llegar.
   - 🟢 **Confirmada** — ya está todo listo, el cliente tiene su cancha.
   - ⚪ **Liberada (timeout)** — el cliente no pagó a tiempo y el sistema
     liberó el horario automáticamente para que otro lo pueda reservar.
   - 🔴 **Cancelada** — la reserva se canceló.

### Confirmar una reserva

Cuando un cliente paga en sede (efectivo, tarjeta física, etc.), o cuando
confirmás por otro medio que un pago en línea sí se completó:

1. Buscá la fila de esa reserva.
2. Tocá el botón **Confirmar**.

### Cancelar una reserva

Tocá el botón **Cancelar** en la fila correspondiente. Esto libera el
horario para que otro cliente lo pueda tomar.

---

## Torneos

### Crear un torneo nuevo

1. Entrá a la pestaña **Torneos** → **+ Nuevo torneo**.
2. Completá el nombre, elegí el formato:
   - **Todos contra todos:** cada equipo juega contra todos los demás una
     vez. Al final hay una tabla de posiciones.
   - **Eliminación directa:** los equipos se enfrentan en llaves; el que
     pierde queda eliminado. Las rondas siguientes se arman solas con los
     ganadores; si un partido termina empatado, el sistema te pide elegir al
     ganador por penales antes de seguir.
3. Poné la fecha de inicio y la cuota de inscripción (en Quetzales). Si el
   torneo no tiene costo de inscripción, poné 0.
4. Tocá **Crear torneo**.

### Cómo se inscriben los equipos

Los equipos se inscriben solos: le compartís a la gente el link del torneo
(`profutbolantigua.com/torneos`), y ahí cada capitán registra su propio
equipo y queda pendiente de pagar la cuota (el link de pago se genera solo).

### Generar el calendario de partidos (fixture)

Una vez que ya se inscribieron al menos 2 equipos:

1. Entrá al torneo (tocá su nombre en la lista de Torneos).
2. Tocá **Generar fixture**.
3. Esto arma automáticamente todos los partidos — **solo se puede hacer
   una vez por torneo**, así que asegurate de que ya estén inscritos todos
   los equipos que van a participar antes de generarlo.

### Cargar resultados

1. Entrá al torneo.
2. En la sección "Capturar resultados", buscá el partido correspondiente.
3. Escribí el marcador de cada equipo y tocá **Guardar**.
4. La tabla de posiciones (si el torneo es "todos contra todos") se
   actualiza sola.

### Ver quién ya pagó la cuota

Dentro del torneo, la lista de equipos muestra una etiqueta junto a cada
uno: **Cuota pagada** (verde) o **Pago pendiente** (amarillo).

---

## Academia de Fútbol

### Registrar un alumno nuevo

1. Entrá a la pestaña **Academia** → **+ Nuevo alumno**.
2. Completá el nombre y fecha de nacimiento del alumno.
3. El campo "Categoría" se sugiere solo según la edad (por ejemplo,
   "Sub-10") — podés dejarlo así o escribir uno distinto si tu academia
   agrupa a los alumnos de otra forma.
4. Completá el nombre y teléfono del encargado (papá, mamá, o quien
   corresponda) — a ese número le va a llegar el link de cobro cada mes y
   los avisos si se atrasa el pago.
5. Tocá **Registrar alumno**.

### Tomar asistencia

1. Entrá a **Academia** → **Tomar asistencia**.
2. Elegí la fecha (por defecto es hoy).
3. Para cada alumno, tocá **Presente** o **Ausente**.
4. No hace falta guardar nada aparte — se guarda apenas tocás el botón. Si
   te equivocás, simplemente tocá el otro botón para corregirlo.

### Ver las mensualidades del mes

1. Entrá a **Academia** → **Mensualidades**.
2. Elegí el mes y año que querés revisar.
3. Vas a ver una fila por alumno, con el monto y si está **Pagada** o
   **Pendiente**.

Los cobros del mes se generan solos el día 1 de cada mes — no tenés que
crearlos vos a mano. Si un mes no ves las mensualidades esperadas, avisale
al equipo técnico.

---

## Reportes

Entrá a la pestaña **Reportes**. Ahí vas a encontrar:

- **Ingresos del periodo:** el total de dinero cobrado (sumando reservas,
  cuotas de torneo y mensualidades de academia), con un desglose por tipo
  y por día. Elegí el rango de fechas arriba.
- **Ocupación por cancha:** qué porcentaje de los horarios disponibles se
  están usando en cada cancha.
- **Morosidad:** la lista de pagos pendientes que ya llevan más de una
  semana sin resolverse, sin importar si son de reservas, torneos o
  academia — útil para saber a quién darle seguimiento.

### Descargar los reportes

Junto a "Ingresos del periodo" y "Morosidad" hay dos botones: **Excel** y
**PDF**. Tocá el que necesites y el archivo se descarga directo a tu
computadora o celular, listo para enviar por correo o usar en tu
contabilidad.

---

## Preguntas frecuentes

**¿Puedo usar el sistema desde mi celular?**
Sí, todas las pantallas están diseñadas para funcionar bien en celular,
no solo en computadora.

**Marqué mal la asistencia de un alumno, ¿cómo lo corrijo?**
Volvé a la pantalla de asistencia de esa fecha y tocá el botón correcto
(Presente/Ausente) — se corrige solo, no hace falta borrar nada.

**Un cliente dice que pagó pero la reserva sigue "pendiente", ¿qué hago?**
Verificá el comprobante de pago con el cliente, y si es válido, tocá
**Confirmar** en esa reserva vos mismo desde el panel — no hace falta
esperar a que el sistema lo detecte solo.

**¿Qué pasa si nadie paga a tiempo?**
El sistema libera el horario automáticamente (15 minutos si el cliente
eligió pagar en línea, 30 minutos si eligió pagar en sede) para que otro
cliente lo pueda reservar.
