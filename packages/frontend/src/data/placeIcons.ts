export interface PlaceIcon {
  id: string
  label: string
  category: string
  svg: string
}

// 使用相对路径 glob，确保 key 的一致性
// 注意：import.meta.glob 返回的 key 是相对于当前文件的路径
export const PLACE_ICONS: PlaceIcon[] = []

export const PLACE_CATEGORIES = [
  { id: 'Building', label: '建筑' },
  { id: 'Public', label: '公共设施' },
  { id: 'Transport', label: '交通' },
  { id: 'Commercial', label: '商业' },
  { id: 'Industrial', label: '工业/设施' },
  { id: 'Outdoor', label: '室外/空间' },
  { id: 'Other', label: '其他' },
]
