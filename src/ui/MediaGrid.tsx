import { FixedSizeGrid, type GridChildComponentProps } from "react-window";
import type { MediaItem } from "../db/database";
import { Thumb } from "./Thumb";
import { useElementSize } from "./useElementSize";

interface MediaGridProps {
  items: MediaItem[];
  onOpen: (item: MediaItem) => void;
}

const TARGET_CELL = 200;

interface CellData {
  items: MediaItem[];
  columns: number;
  onOpen: (item: MediaItem) => void;
}

function Cell({ columnIndex, rowIndex, style, data }: GridChildComponentProps<CellData>) {
  const index = rowIndex * data.columns + columnIndex;
  const item = data.items[index];
  if (!item) return <div style={style} />;
  return (
    <div style={style}>
      <div className="cell-inner">
        <Thumb item={item} onOpen={data.onOpen} />
      </div>
    </div>
  );
}

/** Virtualized, responsive thumbnail grid that recycles off-screen cells. */
export function MediaGrid({ items, onOpen }: MediaGridProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();

  const width = size.width || 0;
  const height = size.height || 0;
  const columns = Math.max(1, Math.floor(width / TARGET_CELL));
  const columnWidth = width > 0 ? Math.floor(width / columns) : TARGET_CELL;
  const rowCount = Math.ceil(items.length / columns);

  return (
    <div ref={ref} className="grid-wrap">
      {width > 0 && height > 0 && (
        <FixedSizeGrid<CellData>
          columnCount={columns}
          columnWidth={columnWidth}
          rowCount={rowCount}
          rowHeight={columnWidth}
          width={width}
          height={height}
          itemData={{ items, columns, onOpen }}
        >
          {Cell}
        </FixedSizeGrid>
      )}
    </div>
  );
}
