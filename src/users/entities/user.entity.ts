import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Course } from '../../courses/entities/course.entity';
import type { Task } from '../../tasks/entities/task.entity';

export enum UserRole {
  Teacher = 'teacher',
  Student = 'student',
}

@Entity({ name: 'users' })
@Index('IDX_USERS_EMAIL', ['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.Student,
  })
  role!: UserRole;

  @Column({ name: 'hashed_refresh_token', nullable: true })
  hashedRefreshToken?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany('Course', 'teacher')
  courses?: Course[];

  @OneToMany('Task', 'creator')
  tasks?: Task[];
}
