interface Props {
  categories: string[];
  included: string[];
  onChange: (cats: string[]) => void;
}

export function CategoryFilter({ categories, included, onChange }: Props) {
  if (categories.length === 0) {
    return <p className="rf-empty-inline">No categories available. Upload data first.</p>;
  }

  const allSelected = included.length === 0;

  function toggle(cat: string) {
    if (included.includes(cat)) {
      onChange(included.filter((c) => c !== cat));
    } else {
      onChange([...included, cat]);
    }
  }

  return (
    <div>
      <label className="rf-check-item" style={{ marginBottom: 6 }}>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => onChange([])}
        />
        <span style={{ fontWeight: 600 }}>All Categories</span>
        <small>{categories.length} total</small>
      </label>
      <div className="rf-check-list">
        {categories.map((cat) => {
          const checked = included.includes(cat);
          return (
            <label key={cat} className="rf-check-item">
              <input
                type="checkbox"
                checked={allSelected || checked}
                disabled={allSelected}
                onChange={() => toggle(cat)}
              />
              <span>{cat}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
