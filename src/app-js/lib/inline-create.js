import { normalizeText } from './utils.js';
/**
 * The name a searchable picker should offer to create, or null when it
 * should not offer anything: the search is blank, or an existing option
 * already carries that name (ignoring case and accents), so creating it
 * would only make a duplicate.
 */
export function inlineCreateName(search, existingNames) {
    const name = search.trim();
    if (!name)
        return null;
    const wanted = normalizeText(name);
    return existingNames.some((existing) => normalizeText(existing.trim()) === wanted) ? null : name;
}
/** cmdk value for the "Create" row. It carries the search text so the
 *  picker's own filter always keeps the row visible. */
export function inlineCreateItemValue(name) {
    return `__create__ ${name}`;
}
