"use client";

import { useEffect, useOptimistic, useRef, useState } from "react";

import {
  addGroceryAction,
  createGroceryCategoryAction,
  deleteGroceryCategoryAction,
  removeGroceryAction,
  renameGroceryCategoryAction,
  updateGroceryAction,
} from "@/lib/panel/actions";
import {
  PanelCompactInput,
  PanelList,
  PanelSelect,
} from "@/components/panel/ui";
import {
  PanelIcon,
  PanelIconButton,
  PendingIconButton,
  PendingSubmitButton,
} from "@/components/panel/pending-button";
import { GroceryShopPicker } from "@/components/panel/grocery-shop-picker";
import { focusFieldIntoView } from "@/lib/panel/focus-field";

export type GroceryCategoryView = {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
};

export type GroceryListItemView = {
  id: string;
  name: string;
  quantityText: string | null;
  categoryId: string;
};

type OptimisticState = {
  items: GroceryListItemView[];
  categories: GroceryCategoryView[];
};

type OptimisticAction =
  | { type: "add"; item: GroceryListItemView }
  | { type: "remove"; id: string }
  | {
      type: "update";
      id: string;
      name: string;
      quantityText: string | null;
      categoryId: string;
    }
  | { type: "addCategory"; category: GroceryCategoryView }
  | { type: "renameCategory"; id: string; name: string }
  | { type: "deleteCategory"; id: string; defaultCategoryId: string };

function reduceState(
  state: OptimisticState,
  action: OptimisticAction,
): OptimisticState {
  switch (action.type) {
    case "add":
      return {
        ...state,
        items: [...state.items, action.item].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      };
    case "remove":
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.id),
      };
    case "update":
      return {
        ...state,
        items: state.items
          .map((item) =>
            item.id === action.id
              ? {
                  ...item,
                  name: action.name,
                  quantityText: action.quantityText,
                  categoryId: action.categoryId,
                }
              : item,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    case "addCategory":
      return {
        ...state,
        categories: [...state.categories, action.category],
      };
    case "renameCategory":
      return {
        ...state,
        categories: state.categories.map((category) =>
          category.id === action.id
            ? { ...category, name: action.name }
            : category,
        ),
      };
    case "deleteCategory":
      return {
        categories: state.categories.filter(
          (category) => category.id !== action.id,
        ),
        items: state.items.map((item) =>
          item.categoryId === action.id
            ? { ...item, categoryId: action.defaultCategoryId }
            : item,
        ),
      };
    default:
      return state;
  }
}

export function GroceryListClient({
  initialItems,
  initialCategories,
  harrisTeeterLinked = false,
}: {
  initialItems: GroceryListItemView[];
  initialCategories: GroceryCategoryView[];
  harrisTeeterLinked?: boolean;
}) {
  const [state, setOptimistic] = useOptimistic(
    { items: initialItems, categories: initialCategories },
    reduceState,
  );
  const [addingCategoryId, setAddingCategoryId] = useState<string | null>(null);
  const [addingNewCategory, setAddingNewCategory] = useState(false);
  const [shoppingItem, setShoppingItem] = useState<GroceryListItemView | null>(
    null,
  );
  const categoryFormRef = useRef<HTMLFormElement>(null);

  const defaultCategory =
    state.categories.find((category) => category.isDefault) ??
    state.categories[0];

  const orderedCategories = [...state.categories].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });

  const categoryOptions = orderedCategories.map((category) => ({
    value: category.id,
    label: category.isDefault ? `${category.name} · HT shop` : category.name,
  }));

  const hasMultipleCategories = orderedCategories.length > 1;

  const addCategoryControl = addingNewCategory ? null : (
    <button
      type="button"
      className="inline-flex h-10 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      onClick={() => setAddingNewCategory(true)}
    >
      <PanelIcon>+</PanelIcon>
      Add category
    </button>
  );

  const addCategoryForm = addingNewCategory ? (
    <form
      ref={categoryFormRef}
      className="mb-4 flex gap-2"
      action={async (formData) => {
        const name = String(formData.get("name") ?? "").trim();
        if (!name) return;
        setOptimistic({
          type: "addCategory",
          category: {
            id: `temp-cat-${crypto.randomUUID()}`,
            name,
            isDefault: false,
            sortOrder: state.categories.length + 1,
          },
        });
        setAddingNewCategory(false);
        categoryFormRef.current?.reset();
        await createGroceryCategoryAction(formData);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setAddingNewCategory(false);
        }
      }}
    >
      <PanelCompactInput
        name="name"
        placeholder="Category name…"
        required
        autoFocus
        className="min-w-0 flex-1"
      />
      <PendingSubmitButton
        variant="primary"
        className="!h-10 !min-h-10 !w-auto !shrink-0 !rounded-md !px-3"
        pendingLabel="…"
      >
        Add
      </PendingSubmitButton>
      <button
        type="button"
        className="h-10 shrink-0 rounded-md px-3 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        onClick={() => setAddingNewCategory(false)}
      >
        Cancel
      </button>
    </form>
  ) : null;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-xl font-semibold tracking-tight sm:text-2xl">
          Grocery list
        </h1>
        {addCategoryControl}
      </div>
      {addCategoryForm}
      <div className="space-y-6">
        {orderedCategories.map((category) => {
          const items = state.items.filter(
            (item) => item.categoryId === category.id,
          );
          const isAdding = addingCategoryId === category.id;

          return (
            <section key={category.id} className="min-w-0">
              <CategoryHeader
                category={category}
                itemCount={items.length}
                onRename={async (formData) => {
                  const name = String(formData.get("name") ?? "").trim();
                  if (!name) return;
                  setOptimistic({
                    type: "renameCategory",
                    id: category.id,
                    name,
                  });
                  await renameGroceryCategoryAction(formData);
                }}
                onDelete={
                  !category.isDefault && defaultCategory
                    ? async (formData) => {
                        setOptimistic({
                          type: "deleteCategory",
                          id: category.id,
                          defaultCategoryId: defaultCategory.id,
                        });
                        await deleteGroceryCategoryAction(formData);
                      }
                    : undefined
                }
              />

              <div className="mt-2">
                {isAdding ? (
                  <InlineAddItem
                    categoryId={category.id}
                    onCancel={() => setAddingCategoryId(null)}
                    onAdd={async (formData) => {
                      const name = String(formData.get("name") ?? "").trim();
                      const quantityText = String(
                        formData.get("quantityText") ?? "",
                      ).trim();
                      if (!name) return;
                      setOptimistic({
                        type: "add",
                        item: {
                          id: `temp-${crypto.randomUUID()}`,
                          name,
                          quantityText: quantityText || null,
                          categoryId: category.id,
                        },
                      });
                      await addGroceryAction(formData);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                    onClick={() => setAddingCategoryId(category.id)}
                  >
                    <PanelIcon>+</PanelIcon>
                    Add item
                  </button>
                )}
              </div>

              {items.length > 0 ? (
                <div className="mt-2">
                  <PanelList>
                    {items.map((item) => (
                      <GroceryRow
                        key={item.id}
                        item={item}
                        categoryOptions={categoryOptions}
                        showCategory={hasMultipleCategories}
                        canShop={Boolean(
                          category.isDefault && harrisTeeterLinked,
                        )}
                        onShop={
                          category.isDefault
                            ? () => setShoppingItem(item)
                            : undefined
                        }
                        onRemove={async (formData) => {
                          setOptimistic({ type: "remove", id: item.id });
                          await removeGroceryAction(formData);
                        }}
                        onUpdate={async (formData) => {
                          const name = String(formData.get("name") ?? "").trim();
                          const quantityText = String(
                            formData.get("quantityText") ?? "",
                          ).trim();
                          const categoryId = String(
                            formData.get("categoryId") ?? item.categoryId,
                          ).trim();
                          if (!name) return;
                          setOptimistic({
                            type: "update",
                            id: item.id,
                            name,
                            quantityText: quantityText || null,
                            categoryId,
                          });
                          await updateGroceryAction(formData);
                        }}
                      />
                    ))}
                  </PanelList>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {shoppingItem ? (
        <GroceryShopPicker
          groceryItemId={shoppingItem.id}
          itemName={shoppingItem.name}
          onClose={() => setShoppingItem(null)}
          onAdded={() => {
            setOptimistic({ type: "remove", id: shoppingItem.id });
          }}
        />
      ) : null}
    </>
  );
}

function CategoryHeader({
  category,
  itemCount,
  onRename,
  onDelete,
}: {
  category: GroceryCategoryView;
  itemCount: number;
  onRename: (formData: FormData) => void | Promise<void>;
  onDelete?: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) focusFieldIntoView(nameRef.current);
  }, [editing]);

  const subtitle =
    itemCount === 0
      ? category.isDefault
        ? "Harris Teeter shop · empty"
        : "Empty"
      : category.isDefault
        ? `Harris Teeter shop · ${itemCount} item${itemCount === 1 ? "" : "s"}`
        : `${itemCount} item${itemCount === 1 ? "" : "s"}`;

  if (editing) {
    return (
      <div
        className="flex min-w-0 gap-1"
        onBlur={() => {
          requestAnimationFrame(() => {
            const active = document.activeElement;
            const root = formRef.current?.parentElement;
            if (!root || (active && root.contains(active))) return;
            setEditing(false);
          });
        }}
      >
        <form
          ref={formRef}
          className="flex min-w-0 flex-1 gap-2"
          action={async (formData) => {
            await onRename(formData);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
              return;
            }
            if (event.key !== "Enter") return;
            event.preventDefault();
            formRef.current?.requestSubmit();
          }}
        >
          <input type="hidden" name="categoryId" value={category.id} />
          <PanelCompactInput
            name="name"
            defaultValue={category.name}
            required
            inputRef={nameRef}
            className="min-w-0 flex-1"
          />
          <PendingIconButton
            variant="icon-success"
            title="Save"
            aria-label="Save"
          >
            ✓
          </PendingIconButton>
          <PanelIconButton
            onClick={() => setEditing(false)}
            aria-label="Cancel"
          >
            ×
          </PanelIconButton>
        </form>
        {onDelete ? (
          <form action={onDelete}>
            <input type="hidden" name="categoryId" value={category.id} />
            <PendingIconButton
              variant="icon-danger"
              title="Delete category"
              aria-label="Delete category"
            >
              ×
            </PendingIconButton>
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="min-w-0 w-full text-left"
      onClick={() => setEditing(true)}
    >
      <h2 className="truncate text-sm font-semibold tracking-tight text-neutral-800 dark:text-neutral-100">
        {category.name}
      </h2>
      <p className="text-xs text-neutral-500">{subtitle}</p>
    </button>
  );
}

function cancelWhenFocusLeavesForm(
  form: HTMLFormElement | null,
  cancel: () => void,
) {
  requestAnimationFrame(() => {
    if (!form) return;
    if (form.contains(document.activeElement)) return;
    cancel();
  });
}

function InlineAddItem({
  categoryId,
  onAdd,
  onCancel,
}: {
  categoryId: string;
  onAdd: (formData: FormData) => void | Promise<void>;
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    focusFieldIntoView(nameRef.current);
  }, []);

  return (
    <form
      ref={formRef}
      className="flex gap-2 rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900"
      action={async (formData) => {
        const name = String(formData.get("name") ?? "").trim();
        if (!name) {
          focusFieldIntoView(nameRef.current);
          return;
        }
        await onAdd(formData);
        formRef.current?.reset();
        focusFieldIntoView(nameRef.current);
      }}
      onBlur={() => cancelWhenFocusLeavesForm(formRef.current, onCancel)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
          return;
        }
        if (event.key !== "Enter") return;
        if (event.target instanceof HTMLTextAreaElement) return;
        event.preventDefault();
        formRef.current?.requestSubmit();
      }}
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <PanelCompactInput
        name="name"
        placeholder="Item…"
        required
        inputRef={nameRef}
        className="min-w-0 flex-1"
      />
      <PanelCompactInput
        name="quantityText"
        placeholder="Qty"
        className="w-16 shrink-0"
      />
      <button type="submit" className="sr-only">
        Add
      </button>
      <PanelIconButton onClick={onCancel} aria-label="Cancel">
        ×
      </PanelIconButton>
    </form>
  );
}

function GroceryRow({
  item,
  categoryOptions,
  showCategory,
  canShop,
  onShop,
  onRemove,
  onUpdate,
}: {
  item: GroceryListItemView;
  categoryOptions: Array<{ value: string; label: string }>;
  showCategory: boolean;
  canShop?: boolean;
  onShop?: () => void;
  onRemove: (formData: FormData) => void | Promise<void>;
  onUpdate: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const qty = item.quantityText?.trim();

  useEffect(() => {
    if (editing) focusFieldIntoView(nameRef.current);
  }, [editing]);

  if (editing) {
    return (
      <li className="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800">
        <form
          ref={formRef}
          className="flex gap-2 p-2"
          action={async (formData) => {
            await onUpdate(formData);
            setEditing(false);
          }}
          onBlur={() =>
            cancelWhenFocusLeavesForm(formRef.current, () => setEditing(false))
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
              return;
            }
            if (event.key !== "Enter") return;
            if (event.target instanceof HTMLTextAreaElement) return;
            event.preventDefault();
            formRef.current?.requestSubmit();
          }}
        >
          <input type="hidden" name="id" value={item.id} />
          <PanelCompactInput
            name="name"
            defaultValue={item.name}
            required
            inputRef={nameRef}
            className="min-w-0 flex-1"
          />
          <PanelCompactInput
            name="quantityText"
            defaultValue={qty ?? ""}
            placeholder="Qty"
            className="w-16 shrink-0"
          />
          {showCategory ? (
            <div className="w-28 shrink-0 sm:w-36">
              <PanelSelect
                name="categoryId"
                defaultValue={item.categoryId}
                options={categoryOptions}
              />
            </div>
          ) : (
            <input type="hidden" name="categoryId" value={item.categoryId} />
          )}
          <button type="submit" className="sr-only">
            Save
          </button>
          <PanelIconButton
            onClick={() => setEditing(false)}
            aria-label="Cancel"
          >
            ×
          </PanelIconButton>
        </form>
      </li>
    );
  }

  return (
    <li className="group/row flex items-stretch transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
      <button
        type="button"
        className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 px-3 py-1.5 text-left"
        onClick={() => setEditing(true)}
      >
        <span className="truncate font-medium">{item.name}</span>
        {qty ? (
          <span className="shrink-0 text-sm text-neutral-500">· {qty}</span>
        ) : null}
      </button>
      <div className="flex shrink-0 items-center border-l border-neutral-100 dark:border-neutral-800">
        {canShop && onShop ? (
          <PanelIconButton
            onClick={onShop}
            title="Shop at Harris Teeter"
            aria-label="Shop at Harris Teeter"
          >
            $
          </PanelIconButton>
        ) : null}
        <form action={onRemove}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="name" value={item.name} />
          <PendingIconButton
            variant="icon-danger"
            title="Remove"
            aria-label="Remove"
          >
            ×
          </PendingIconButton>
        </form>
      </div>
    </li>
  );
}

