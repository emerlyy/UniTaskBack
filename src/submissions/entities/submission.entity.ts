import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Task } from '../../tasks/entities/task.entity';
import type { User } from '../../users/entities/user.entity';

@Entity({ name: 'submissions' })
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id' })
  taskId!: string;

  @Column({ name: 'student_id' })
  studentId!: string;

  @Column({ name: 'answer_text', type: 'text', nullable: true })
  answerText?: string | null;

  @Column({ name: 'auto_score', type: 'float', nullable: true })
  autoScore?: number | null;

  @ManyToOne('Task', 'submissions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: Task;

  @ManyToOne('User', 'submissions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
