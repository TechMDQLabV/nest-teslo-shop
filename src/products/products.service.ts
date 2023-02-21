import { Injectable, InternalServerErrorException, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { DataSource, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductImage } from './entities';
import { validate as isUUID } from 'uuid';

@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProductsService');

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createProductDto: CreateProductDto) {
    const { images = [], ...productDetails } = createProductDto;
    try {
      const product = this.productRepository.create({
        ...productDetails,
        images: images.map( image => this.productImageRepository.create({ url: image }))
      });
      await this.productRepository.save(product);

      return { ...product , images };
    } catch (error){
      this.handleDbExceptions(error);
    }
  }

  // TODO Paginar
  async findAll( paginationDto: PaginationDto ) {
    const { limit = 10, offset = 0 } = paginationDto;
    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      relations: {
        images: true
      }
    });

    return products.map( ({ images, ...rest }) => ({
      ...rest,
      images: images.map( img => img.url )
    }))
  }

  async findOne(search: string) {
    let product: Product;

    if( isUUID(search)){
      product = await this.productRepository.findOneBy({ id: search });
    }else{
      const queryBuilder = this.productRepository.createQueryBuilder('prod');
      product = await queryBuilder
        .where('LOWER(title) =:title or slug =:slug', {
          title: search.toUpperCase(),
          slug: search.toLowerCase()
        })
        .leftJoinAndSelect('prod.images', 'prodImages')
        .getOne();
    }

    if(!product){
      throw new NotFoundException(`Producto with id ${search} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { images, ...toUpdate } = updateProductDto;

    const product = await this.productRepository.preload({ id: id, ...toUpdate });
    if(!product){
      throw new NotFoundException(`Product with id: ${ id } not found`);
    }

    /// Create queryRunner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try{
      if( images ){
        await queryRunner.manager.delete( ProductImage, { product: { id } } );

        product.images = images.map( image => this.productImageRepository.create({ url:image }));
      }
      
      await queryRunner.manager.save( product );
      //await this.productRepository.save(product)
      await queryRunner.commitTransaction();
      await queryRunner.release();      
    }catch(error){
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbExceptions(error);
    }

    return this.findOnePlain( id );
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productRepository.remove( product );
  }

  private handleDbExceptions( error: any ){
    if(error.code === '23505'){
      throw new BadRequestException(error.detail);
    }
    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error, check server logs');
  }

  async findOnePlain( search: string ){
    const { images = [], ...product } = await this.findOne( search );
    return {
      ...product,
      images: images.map( image => image.url )
    }
  }

  async deleteAllProducts() {
    const query = this.productImageRepository.createQueryBuilder('product');

    try{
      return await query
        .delete()
        .where({})
        .execute();
    }catch(error){
      this.handleDbExceptions(error);
    }
  }

}
