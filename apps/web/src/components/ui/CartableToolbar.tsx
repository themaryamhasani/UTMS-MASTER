import { Search } from 'lucide-react';
import { ExportButton, exportToExcel } from './Table';

type ExportColumn = {
  key: string;
  title: string;
};

type FilterOption = {
  value: string;
  label: string;
};

export function CartableSearchInput({
  value,
  onChange,
  placeholder = 'جستجو...',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative flex-1 min-w-[200px] ${className}`}>
      <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

export function CartableExcelExportButton<T extends object>({
  data,
  columns,
  filename,
  disabled,
}: {
  data: T[];
  columns: ExportColumn[];
  filename: string;
  disabled?: boolean;
}) {
  return (
    <ExportButton
      onClick={() => exportToExcel(data, columns, filename)}
      disabled={disabled ?? data.length === 0}
    />
  );
}

export function CartableSelectFilter({
  value,
  onChange,
  options,
  allLabel = 'همه وضعیت‌ها',
  ariaLabel = 'فیلتر وضعیت',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
