export function findCategoryReference(categories, categoryId) {
    return categories.find((category) => category.id === categoryId);
}
export function getRuleCategoryId(rule) {
    return rule.actions.find((action) => action.op === 'set_category' && action.value)?.value ?? null;
}
export function getRuleCategoryName(rule, categories) {
    const categoryId = getRuleCategoryId(rule);
    if (!categoryId)
        return null;
    return findCategoryReference(categories, categoryId)?.name ?? null;
}
