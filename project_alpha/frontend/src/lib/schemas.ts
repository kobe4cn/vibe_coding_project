import { z } from 'zod';

// Ticket schemas
export const createTicketSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255, '标题最多255个字符'),
  description: z.string().max(5000, '描述最多5000个字符').optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

export const updateTicketSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255, '标题最多255个字符').optional(),
  description: z.string().max(5000, '描述最多5000个字符').optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  resolution: z.string().max(5000, '处理结果最多5000个字符').optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']),
  resolution: z.string().max(5000, '处理结果最多5000个字符').optional(),
}).refine(
  (data) => {
    // Resolution required when completing
    if (data.status === 'completed') {
      return data.resolution && data.resolution.trim().length > 0;
    }
    return true;
  },
  {
    message: '完成票据时必须填写处理结果',
    path: ['resolution'],
  }
);

// Tag schemas
export const createTagSchema = z.object({
  name: z.string().min(1, '标签名称不能为空').max(100, '标签名称最多100个字符'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式无效，应为 #RRGGBB')
    .default('#6B7280'),
  icon: z.string().max(50, '图标名称最多50个字符').optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1, '标签名称不能为空').max(100, '标签名称最多100个字符').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式无效').optional(),
  icon: z.string().max(50).optional(),
});

// Infer types
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

