import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Product {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('text', {
        unique: true,
    })
    title: string;

    @Column('float', {
        default: 0,
    })
    price: number;

    @Column({
        type: 'text',
        nullable: true
    })
    description: string;

    @Column({
        unique: true
    })
    slug: string;

    @Column('int', {
        default: 0
    })
    stock: number;

    @Column('text', {
        array: true
    })
    sizes: string[]

    @Column('text')
    gender: string;

    @Column('text',{
        array: true,
        default: []
    })
    tags: string[];

    @BeforeInsert()
    checkSlugInsert(){
        if(!this.slug){
            this.slug = this.title;
        }
        this.slug = this.normalizeSlug(this.slug);
    }

    @BeforeUpdate()
    checkSlugUpdate(){
        this.slug = this.normalizeSlug(this.slug);       
    }

    private normalizeSlug(slug: string):string{
        slug = slug
            .toLowerCase()
            .replaceAll(' ', '_')
            .replaceAll("'",'');  
        return slug;
    }
}