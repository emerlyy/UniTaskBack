import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';
import { User } from '../../users/entities/user.entity';
import { SubmissionFile } from './submission-file.entity';

export enum SubmissionStatus {
  Pending = 'pending',
  Graded = 'graded',
}

@Entity('student_submissions')
export class StudentSubmission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id' })
  taskId!: string;

  @Column({ name: 'student_id' })
  studentId!: string;

  @Column({
    name: 'submitted_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  submittedAt!: Date;

  @Column({ name: 'auto_score', type: 'int', nullable: true })
  autoScore?: number | null;

  @Column({ name: 'final_score', type: 'int', nullable: true })
  finalScore?: number | null;

  @Column({ type: 'text' })
  status!: SubmissionStatus;

  @ManyToOne(() => Task, (task) => task.submissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => User, (user) => user.submissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @OneToMany(() => SubmissionFile, (file) => file.submission, {
    cascade: true,
  })
  files?: SubmissionFile[];
}
