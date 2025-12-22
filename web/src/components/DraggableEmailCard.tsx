import { useDrag } from 'react-dnd';
import type { Email } from '../types';
import { EmailCard } from './EmailCard';

export const DRAGGABLE_EMAIL_TYPE = 'email';

export interface DragItem {
  type: typeof DRAGGABLE_EMAIL_TYPE;
  emailIds: number[];
  emails: Email[];
}

interface DraggableEmailCardProps {
  email: Email;
  onClick: () => void;
  isSelected?: boolean;
  onSelect?: (emailId: number, isMultiSelect: boolean) => void;
  selectedEmailIds?: number[];
}

export function DraggableEmailCard({
  email,
  onClick,
  isSelected = false,
  onSelect,
  selectedEmailIds = [],
}: DraggableEmailCardProps) {
  const dragItem: DragItem = {
    type: DRAGGABLE_EMAIL_TYPE,
    emailIds: isSelected && selectedEmailIds.length > 0 
      ? selectedEmailIds 
      : email.id ? [email.id] : [],
    emails: [email],
  };

  const [{ isDragging }, drag] = useDrag(() => ({
    type: DRAGGABLE_EMAIL_TYPE,
    item: dragItem,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [email, isSelected, selectedEmailIds]);

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      // Multi-select
      if (onSelect && email.id) {
        onSelect(email.id, true);
      }
    } else {
      onClick();
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect && email.id) {
      onSelect(email.id, e.ctrlKey || e.metaKey || e.shiftKey);
    }
  };

  return (
    <div
      ref={drag}
      className={`relative ${isDragging ? 'opacity-50' : ''} ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 rounded-xl' : ''
      }`}
    >
      {/* Selection checkbox */}
      {onSelect && (
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
          onClick={handleCheckboxClick}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-500 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      )}
      
      <div className={onSelect ? 'pl-8' : ''}>
        <EmailCard
          email={email}
          onClick={handleClick}
        />
      </div>

      {/* Drag count indicator */}
      {isDragging && isSelected && selectedEmailIds.length > 1 && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
          {selectedEmailIds.length}
        </div>
      )}
    </div>
  );
}

