const steps = [
  ["Tipo de cálculo", "Selecione o tipo de cálculo"],
  ["Dados", "Informe os dados básicos"],
  ["Regras", "Defina as regras e parâmetros"],
  ["Resultado", "Veja o resultado do cálculo"],
];

export function Stepper({ currentStep }) {
  return (
    <ol className="stepper" aria-label="Etapas do cálculo">
      {steps.map(([title, subtitle], index) => {
        const number = index + 1;
        const state = number === currentStep ? "active" : number < currentStep ? "completed" : "";
        return <li className={state} key={title}><span className="step-number">{number}</span><span><strong>{number}. {title}</strong><small>{subtitle}</small></span></li>;
      })}
    </ol>
  );
}
