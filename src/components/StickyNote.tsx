import { useRef, useCallback, useState, useEffect } from 'react';
import type { StickyNote as StickyNoteType } from '../types/widget';
import classes from './StickyNote.module.css';

interface Props {
  note: StickyNoteType;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (u: Partial<StickyNoteType>) => void;
  onRemove: () => void;
}

const PRESET_COLORS: Record<string, string> = {
  yellow: '#fef08a',
  pink: '#fbcfe8',
  blue: '#bfdbfe',
  green: '#bbf7d0',
};

const PRESET_NAMES = Object.keys(PRESET_COLORS) as string[];

function resolveColor(color: string): string {
  if (color.startsWith('#')) return color;
  return PRESET_COLORS[color] ?? PRESET_COLORS.yellow;
}

export function StickyNote({ note, containerRef, onUpdate, onRemove }: Props) {
  const noteRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [text, setText] = useState(note.text);
  const [showColors, setShowColors] = useState(false);

  // Sync text if note changes externally (e.g. from poll)
  useEffect(() => {
    setText(note.text);
  }, [note.text]);

  const rotation = (note.id.charCodeAt(0) % 7) - 3;
  const bg = resolveColor(note.color);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate({ text: val });
    }, 500);
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Don't intercept clicks on textarea, toolbar buttons, or color picker
      if (
        (e.target as HTMLElement).tagName === 'TEXTAREA' ||
        (e.target as HTMLElement).closest('button') ||
        (e.target as HTMLElement).closest(`.${classes.colorPicker}`) ||
        (e.target as HTMLElement).closest('label')
      )
        return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const startPctX = note.x;
      const startPctY = note.y;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const newX = Math.max(0, Math.min(90, startPctX + (dx / containerRect.width) * 100));
        const newY = Math.max(0, Math.min(90, startPctY + (dy / containerRect.height) * 100));
        if (noteRef.current) {
          noteRef.current.style.left = `${newX}%`;
          noteRef.current.style.top = `${newY}%`;
        }
      };

      const onUp = (ev: PointerEvent) => {
        if (noteRef.current) {
          try {
            noteRef.current.releasePointerCapture(ev.pointerId);
          } catch { /* ignore */ }
        }
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const newX = Math.max(0, Math.min(90, startPctX + (dx / containerRect.width) * 100));
        const newY = Math.max(0, Math.min(90, startPctY + (dy / containerRect.height) * 100));
        onUpdate({ x: newX, y: newY });
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [note.x, note.y, containerRef, onUpdate]
  );

  return (
    <div
      ref={noteRef}
      className={classes.note}
      style={{
        left: `${note.x}%`,
        top: `${note.y}%`,
        background: bg,
        transform: `rotate(${rotation}deg)`,
      }}
      onPointerDown={handlePointerDown}
    >
      <div className={classes.toolbar}>
        <button
          className={classes.colorToggle}
          onClick={(e) => { e.stopPropagation(); setShowColors((v) => !v); }}
          title="Change color"
        >
          <span className={classes.colorDot} style={{ background: bg }} />
        </button>
        {showColors && (
          <div className={classes.colorPicker} onClick={(e) => e.stopPropagation()}>
            {PRESET_NAMES.map((c) => (
              <button
                key={c}
                className={`${classes.swatch} ${!note.color.startsWith('#') && note.color === c ? classes.swatchActive : ''}`}
                style={{ background: PRESET_COLORS[c] }}
                title={c}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ color: c });
                  setShowColors(false);
                }}
              />
            ))}
            <label className={classes.colorInputWrap} title="Custom color">
              <input
                type="color"
                className={classes.colorInput}
                value={bg}
                onChange={(e) => {
                  onUpdate({ color: e.target.value });
                  setShowColors(false);
                }}
              />
            </label>
          </div>
        )}
        <button className={classes.close} onClick={onRemove} title="Remove note">
          ×
        </button>
      </div>
      <textarea
        className={classes.textarea}
        value={text}
        onChange={handleTextChange}
        placeholder="Type a note..."
        style={{ background: bg }}
        rows={4}
      />
    </div>
  );
}
