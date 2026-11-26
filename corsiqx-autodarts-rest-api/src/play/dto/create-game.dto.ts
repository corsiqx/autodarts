import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const IN_OUT_MODES = ['Straight', 'Double', 'Master'] as const;
export type InOutMode = (typeof IN_OUT_MODES)[number];

/** A bot (by 3-dart average) or a local guest on the host's board. */
export class OpponentDto {
  @IsIn(['bot', 'guest'])
  kind!: 'bot' | 'guest';

  @ValidateIf((o: OpponentDto) => o.kind === 'bot')
  @IsInt()
  @Min(10)
  @Max(120)
  average?: number;

  @ValidateIf((o: OpponentDto) => o.kind === 'guest')
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  name?: string;
}

export class CreateGameDto {
  @IsIn([101, 170, 201, 301, 401, 501, 601, 701, 801, 901, 1001])
  baseScore!: number;

  @IsIn(IN_OUT_MODES)
  inMode!: InOutMode;

  @IsIn(IN_OUT_MODES)
  outMode!: InOutMode;

  @IsIn(['25/50', '50/50'])
  bullMode!: '25/50' | '50/50';

  /** First to this many legs (per set when `sets` is given). */
  @IsInt()
  @Min(1)
  @Max(11)
  legs!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  sets?: number;

  @IsBoolean()
  bullOff!: boolean;

  /** Scoring board; `null` means scores are typed in by hand. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,64}$/)
  boardId?: string | null;

  @ValidateNested({ each: true })
  @Type(() => OpponentDto)
  @ArrayMaxSize(5)
  opponents!: OpponentDto[];
}
