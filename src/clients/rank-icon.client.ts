import axios, { type AxiosInstance } from 'axios';
import { AppError } from '../utils/errors.js';
import { rankIconAsset } from '../utils/rank-icon.js';

const MAX_IMAGE_BYTES = 256 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export class RankIconClient {
  private readonly http: AxiosInstance;

  constructor(timeoutMs: number, http?: AxiosInstance) {
    this.http = http ?? axios.create({
      timeout: timeoutMs, maxRedirects: 0, maxContentLength: MAX_IMAGE_BYTES,
      responseType: 'arraybuffer', validateStatus: () => true,
      headers: { 'User-Agent': 'PointBlankClanDiscordBot/1.0', Accept: 'image/png' },
    });
  }

  async getImage(source: string): Promise<Buffer> {
    const asset = rankIconAsset(source) ?? rankIconAsset(source, 'clan');
    if (!asset) throw new AppError('RANK_ICON_FAILED', 'The rank image is unavailable.');
    try {
      const response = await this.http.get<Buffer>(asset.url);
      const image = response.data;
      if (response.status !== 200 || !Buffer.isBuffer(image) || image.length < 24 || image.length > MAX_IMAGE_BYTES
        || !image.subarray(0, 8).equals(PNG_SIGNATURE) || image.subarray(12, 16).toString() !== 'IHDR') {
        throw new AppError('RANK_ICON_FAILED', 'Point Blank returned an unavailable rank image.');
      }
      return image;
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Axios errors contain headers and URLs; never retain or serialize the raw error.
      throw new AppError('RANK_ICON_FAILED', 'Could not load the rank image.');
    }
  }
}
