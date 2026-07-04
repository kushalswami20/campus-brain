import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'student@dtu.ac.in' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'S3curePass!' })
  @IsString()
  @MinLength(1)
  password!: string;
}
