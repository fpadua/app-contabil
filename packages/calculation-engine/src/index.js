export function applyAccumulatedFactor(principalInCents, accumulatedFactor) {
  if (!Number.isInteger(principalInCents) || principalInCents <= 0) throw new TypeError("principalInCents must be a positive integer");
  if (!Number.isFinite(accumulatedFactor) || accumulatedFactor <= 0) throw new TypeError("accumulatedFactor must be a positive finite number");
  return Math.round(principalInCents * accumulatedFactor);
}
