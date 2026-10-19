import { ChatIcon, KeyIcon, SearchIcon } from './icons.jsx';

const STEPS = [
  {
    title: 'Busca',
    text: 'Filtra por compra o alquiler, ubicación y tipo de espacio hasta dar con el que encaja contigo.',
    Icon: SearchIcon,
  },
  {
    title: 'Contacta',
    text: 'Escribe al anunciante desde el anuncio para resolver dudas y pedir más información.',
    Icon: ChatIcon,
  },
  {
    title: 'Visita',
    text: 'Queda para ver el espacio en persona y decide con toda la información.',
    Icon: KeyIcon,
  },
];

function HowItWorks({ onComingSoon }) {
  return (
    <section id="como-funciona" className="section" aria-labelledby="como-funciona-title">
      <div className="section__header">
        <h2 id="como-funciona-title" className="section__title">Cómo funciona</h2>
        <p className="section__lead">Del primer vistazo a la visita, en tres pasos.</p>
      </div>

      <ol className="steps">
        {STEPS.map(({ title, text, Icon }, index) => (
          <li key={title} className="step">
            <span className="step__icon"><Icon size={26} /></span>
            <span className="step__number" aria-hidden="true">{index + 1}</span>
            <h3 className="step__title">{title}</h3>
            <p className="step__text">{text}</p>
          </li>
        ))}
      </ol>

      <div className="advertisers">
        <div>
          <h3 className="advertisers__title">¿Tienes un espacio para vender o alquilar?</h3>
          <p className="advertisers__text">
            Particulares y profesionales podrán publicar pisos, locales, oficinas, garajes y trasteros.
          </p>
        </div>
        <button className="button button--accent" type="button" onClick={() => onComingSoon('Publicar anuncios')}>
          Publica tu anuncio
          <span className="badge-soon">Próximamente</span>
        </button>
      </div>
    </section>
  );
}

export default HowItWorks;
