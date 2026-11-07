import { ChatIcon, HeartIcon, HomeIcon } from './icons.jsx';

const STEPS = [
  {
    title: 'Explora',
    text: 'Descubre anuncios de hogares y espacios para tu próximo proyecto.',
    Icon: HomeIcon,
  },
  {
    title: 'Guarda tus favoritos',
    text: 'Inicia sesión para guardar los espacios que quieras consultar más tarde.',
    Icon: HeartIcon,
  },
  {
    title: 'Da el siguiente paso',
    text: 'Revisa cada anuncio y encuentra el espacio que mejor encaja contigo.',
    Icon: ChatIcon,
  },
];

function HowItWorks() {
  return (
    <section id="como-funciona" className="home-section how-it-works" aria-labelledby="how-title">
      <div className="home-section__header">
        <div>
          <p className="home-section__eyebrow">SENCILLO DESDE EL PRINCIPIO</p>
          <h2 id="how-title" className="home-section__title">Cómo funciona</h2>
        </div>
        <p className="home-section__description">Tres pasos para acercarte a tu próximo espacio.</p>
      </div>
      <ol className="steps">
        {STEPS.map(({ title, text, Icon }, index) => (
          <li className="step" key={title}>
            <span className="step__icon"><Icon size={25} /></span>
            <span className="step__number" aria-hidden="true">0{index + 1}</span>
            <h3 className="step__title">{title}</h3>
            <p className="step__text">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default HowItWorks;
