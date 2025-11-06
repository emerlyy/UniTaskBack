import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Course } from '../../courses/entities/course.entity';
import type { StudentSubmission } from '../../submissions/entities/student-submission.entity';

export enum UserRole {
  Teacher = 'teacher',
  Student = 'student',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'full_name', type: 'text' })
  fullName!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ type: 'text' })
  role!: UserRole;

  @OneToMany('Course', 'teacher')
  courses?: Course[];

  @OneToMany('StudentSubmission', 'student')
  submissions?: StudentSubmission[];
}
