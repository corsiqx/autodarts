import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginResult, UserSummary, UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<UserSummary[]> {
    return this.usersService.findAll();
  }

  /** Creates the account after a successful Autodarts login and returns that login. */
  @Post()
  create(@Body() dto: CreateUserDto): Promise<LoginResult> {
    return this.usersService.create(dto);
  }

  /** Logs the stored account into Autodarts. */
  @Post(':id/login')
  @HttpCode(200)
  login(@Param('id', new ParseUUIDPipe()) id: string): Promise<LoginResult> {
    return this.usersService.login(id);
  }
}
