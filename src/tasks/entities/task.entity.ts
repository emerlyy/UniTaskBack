import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from '../../courses/entities/course.entity';
import type { StudentSubmission } from '../../submissions/entities/student-submission.entity';

export enum TaskStatus {
  Draft = 'draft',
  Active = 'active',
  Review = 'review',
  Completed = 'completed',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'course_id' })
  courseId!: string;

  @ManyToOne(() => Course, (course) => course.tasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'course_id' })
  course!: Course;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'timestamptz' })
  deadline!: Date;

  @Column({ name: 'late_penalty_percent', type: 'int', default: 0 })
  latePenaltyPercent!: number;

  @Column({ name: 'reference_file_url', type: 'text' })
  referenceFileUrl!: string;

  @Column({ type: 'text' })
  status!: TaskStatus;

  @OneToMany('StudentSubmission', 'task')
  submissions?: StudentSubmission[];
}
