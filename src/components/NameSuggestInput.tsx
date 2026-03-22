import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  className?: string
  placeholder?: string
  required?: boolean
}

export function NameSuggestInput({ value, onChange, suggestions, className, placeholder, required }: Props) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filtered = value.trim()
    ? [...new Set(suggestions)]
        .filter(s => s.toLowerCase().startsWith(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())
        .slice(0, 5)
    : []

  const showDropdown = open && filtered.length > 0

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && filtered.length > 0 && open) {
      e.preventDefault()
      onChange(filtered[0])
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className={className}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
      />
      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 border border-bg-secondary rounded-lg bg-white shadow-md overflow-hidden">
          {filtered.map(name => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(name); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-sm font-sans text-text-primary hover:bg-bg-secondary/50 transition-colors border-b border-bg-secondary last:border-b-0"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
