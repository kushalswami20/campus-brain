import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ enum: RoleName })
  role!: RoleName;

  @ApiProperty({ required: false, nullable: true })
  branch!: string | null;

  @ApiProperty({ required: false, nullable: true })
  semester!: number | null;
}

export class AuthTokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ description: 'Access-token lifetime, e.g. "15m".' })
  expiresIn!: string;
}

export class AuthResultDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: AuthTokensDto })
  tokens!: AuthTokensDto;
}
