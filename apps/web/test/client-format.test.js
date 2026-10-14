import assert from "node:assert/strict";
import test from "node:test";
import { maskDocument, maskPhone } from "../lib/client-format.js";

test("aplica máscara de CPF e CNPJ", () => {
  assert.equal(maskDocument("12345678901", "Pessoa física"), "123.456.789-01");
  assert.equal(maskDocument("12345678000199", "Pessoa jurídica"), "12.345.678/0001-99");
});

test("aplica máscara de telefone fixo e celular", () => {
  assert.equal(maskPhone("6232345678"), "(62) 3234-5678");
  assert.equal(maskPhone("62999998888"), "(62) 99999-8888");
});
