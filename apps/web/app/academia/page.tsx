import type { Metadata } from 'next';
import SiteHeader from '../../components/public/SiteHeader';
import SiteFooter from '../../components/public/SiteFooter';

export const metadata: Metadata = {
  title: 'Academia de Fútbol - Pro Futbol Antigua',
  description:
    'Academia de fútbol para niños y niñas de 5 a 17 años en Antigua Guatemala. Categorías U-7 a U-17, horarios martes, jueves y sábado, inscripción gratis.',
};

const HORARIOS = [
  { categoria: 'U-7', edades: '5 a 7 años', semana: '4:00 PM – 5:00 PM', sabado: '9:00 AM – 10:00 AM' },
  { categoria: 'U-9', edades: '8 a 9 años', semana: '5:00 PM – 6:00 PM', sabado: '10:00 AM – 11:00 AM' },
  { categoria: 'U-11', edades: '10 a 11 años', semana: '3:00 PM – 4:00 PM', sabado: '10:00 AM – 11:00 AM' },
  { categoria: 'U-13 / U-15 / U-17', edades: '12 a 17 años', semana: '5:00 PM – 6:00 PM', sabado: '11:00 AM – 12:00 PM' },
];

export default function AcademiaPage() {
  return (
    <div className="min-h-screen bg-white text-[#122447]">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="py-20 px-6 bg-gradient-to-br from-[#0a3d7d] to-[#0f59b3]">
          <div className="max-w-[1180px] mx-auto text-center">
            <p className="text-[13px] font-semibold tracking-wider text-[#d8b32d] mb-5">
              Formación · Disciplina · Pasión por el fútbol
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
              Academia de Fútbol<br/>
              <em className="not-italic text-[#d8b32d]">Pro Futbol Antigua</em>
            </h1>
            <p className="text-lg text-[#dce8ff] leading-relaxed max-w-[560px] mx-auto">
              Formamos niñas y niños de 5 a 17 años con entrenamiento de calidad en un ambiente seguro y divertido.
            </p>
          </div>
        </section>

        {/* Participantes */}
        <section className="py-20 px-6">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <p className="text-[13px] font-bold text-[#1668c9] mb-3 tracking-wide">Participantes</p>
              <h2 className="text-3xl font-bold text-[#0a3d7d] mb-4">¿Quién puede unirse?</h2>
              <p className="text-[#5b6b85] leading-relaxed">
                Niñas y niños de 5 a 17 años, en categorías femeninas y masculinas.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 max-w-[700px] mx-auto">
              <div className="bg-white rounded-[22px] p-8 shadow-[0_10px_30px_rgba(15,60,130,.08)] border-t-4 border-[#d8b32d] text-center">
                <h3 className="text-lg font-bold text-[#0a3d7d] mb-1">Edades</h3>
                <p className="text-sm text-[#5b6b85]">De 5 a 17 años, organizados por categoría.</p>
              </div>
              <div className="bg-white rounded-[22px] p-8 shadow-[0_10px_30px_rgba(15,60,130,.08)] border-t-4 border-[#d8b32d] text-center">
                <h3 className="text-lg font-bold text-[#0a3d7d] mb-1">Categorías</h3>
                <p className="text-sm text-[#5b6b85]">Femenina y masculina.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Costos */}
        <section className="py-20 px-6 bg-[#f2f8ff]">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <p className="text-[13px] font-bold text-[#1668c9] mb-3 tracking-wide">Costos</p>
              <h2 className="text-3xl font-bold text-[#0a3d7d] mb-4">Inscripción y mensualidad</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-7 max-w-[980px] mx-auto">
              <div className="bg-white rounded-[22px] p-8 shadow-[0_18px_40px_rgba(6,32,70,.12)] border-t-4 border-[#1668c9] text-center">
                <h3 className="text-sm font-bold text-[#5b6b85] mb-2 tracking-wide">Inscripción</h3>
                <div className="text-3xl font-bold text-[#0f59b3]">Gratis</div>
              </div>
              <div className="bg-white rounded-[22px] p-8 shadow-[0_18px_40px_rgba(6,32,70,.12)] border-t-4 border-[#d8b32d] text-center">
                <h3 className="text-sm font-bold text-[#5b6b85] mb-2 tracking-wide">1 a 9 días al mes</h3>
                <div className="text-3xl font-bold text-[#0f59b3]">Q150<span className="text-base font-medium text-[#5b6b85]">/mes</span></div>
              </div>
              <div className="bg-white rounded-[22px] p-8 shadow-[0_18px_40px_rgba(6,32,70,.12)] border-t-4 border-[#d8b32d] text-center">
                <h3 className="text-sm font-bold text-[#5b6b85] mb-2 tracking-wide">10 días o más al mes</h3>
                <div className="text-3xl font-bold text-[#0f59b3]">Q225<span className="text-base font-medium text-[#5b6b85]">/mes</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* Horarios */}
        <section className="py-20 px-6">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <p className="text-[13px] font-bold text-[#1668c9] mb-3 tracking-wide">Horarios</p>
              <h2 className="text-3xl font-bold text-[#0a3d7d] mb-4">Entrenamos martes, jueves y sábado</h2>
              <p className="text-[#5b6b85] leading-relaxed">El horario depende de la categoría del alumno.</p>
            </div>

            <div className="max-w-[820px] mx-auto overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-xs font-bold text-[#5b6b85] tracking-wide">
                    <th className="px-5">Categoría</th>
                    <th className="px-5">Edades</th>
                    <th className="px-5">Martes y jueves</th>
                    <th className="px-5">Sábado</th>
                  </tr>
                </thead>
                <tbody>
                  {HORARIOS.map((h) => (
                    <tr key={h.categoria} className="bg-white shadow-[0_10px_30px_rgba(15,60,130,.08)]">
                      <td className="px-5 py-4 rounded-l-[14px] font-bold text-[#0a3d7d]">{h.categoria}</td>
                      <td className="px-5 py-4 text-sm text-[#5b6b85]">{h.edades}</td>
                      <td className="px-5 py-4 text-sm text-[#33475f]">{h.semana}</td>
                      <td className="px-5 py-4 rounded-r-[14px] text-sm text-[#33475f]">{h.sabado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Método de Entrenamiento */}
        <section className="py-20 px-6 bg-[#f2f8ff]">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto">
              <p className="text-[13px] font-bold text-[#1668c9] mb-3 tracking-wide">Método de Entrenamiento</p>
              <h2 className="text-3xl font-bold text-[#0a3d7d] mb-4">Próximamente</h2>
              <p className="text-[#5b6b85] leading-relaxed">Estamos preparando el contenido sobre nuestra metodología de entrenamiento.</p>
            </div>
          </div>
        </section>

        {/* Valores */}
        <section className="py-20 px-6">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto">
              <p className="text-[13px] font-bold text-[#1668c9] mb-3 tracking-wide">Valores</p>
              <h2 className="text-3xl font-bold text-[#0a3d7d] mb-4">Próximamente</h2>
              <p className="text-[#5b6b85] leading-relaxed">Estamos preparando el contenido sobre los valores que formamos en nuestros alumnos.</p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
