import { useDrop } from 'react-dnd';
import { DRAGGABLE_EMAIL_TYPE, type DragItem } from './DraggableEmailCard';
import type { Folder } from '../types';

interface DroppableFolderItemProps {
  folder: Folder;
  children: React.ReactNode;
  onDrop: (emailIds: number[], folderId: string) => void;
  isActive?: boolean;
}

export function DroppableFolderItem({
  folder,
  children,
  onDrop,
  isActive: _isActive = false,
}: DroppableFolderItemProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: DRAGGABLE_EMAIL_TYPE,
    drop: (item: DragItem) => {
      onDrop(item.emailIds, folder.id);
    },
    canDrop: (_item: DragItem) => {
      // Can't drop on the same folder
      return true;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [folder.id, onDrop]);

  const dropStyle = isOver && canDrop
    ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500'
    : canDrop && isOver === false
      ? ''
      : '';

  return (
    <div
      ref={drop as unknown as React.Ref<HTMLDivElement>}
      className={`transition-colors rounded-lg ${dropStyle}`}
    >
      {children}
    </div>
  );
}

