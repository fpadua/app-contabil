export function maskDocument(value, personType = "Pessoa física") {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, personType === "Pessoa jurídica" ? 14 : 11);

  if (personType === "Pessoa jurídica") {
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
  }

  return digits.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function maskPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/^(\(\d{2}\) \d{4})(\d)/, "$1-$2");
  }

  return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/^(\(\d{2}\) \d{5})(\d)/, "$1-$2");
}
