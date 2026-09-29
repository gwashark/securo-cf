export function resolveSelectedCategory(categories, value, currentCategory) {
    return categories.find((category) => category.id === value)
        ?? (currentCategory?.id === value ? currentCategory : undefined);
}
export function isCategoryHiddenFromSelection(categories, category) {
    return Boolean(category
        && (category.is_hidden || !categories.some((item) => item.id === category.id)));
}
