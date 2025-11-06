import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentSubmission } from './student-submission.entity';

@Entity('submission_files')
export class SubmissionFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'submission_id' })
  submissionId!: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl!: string;

  @ManyToOne(() => StudentSubmission, (submission) => submission.files, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'submission_id' })
  submission!: StudentSubmission;
}
