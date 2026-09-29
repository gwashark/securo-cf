import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
/**
 * Accent- and case-insensitive normalization for substring matching.
 * Strips diacritics so "orcamento" matches "Orçamento", etc.
 */
export function normalizeText(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
