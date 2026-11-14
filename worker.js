const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};
const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" }
});
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, {headers:cors});
    if (!env.DB) return json({ok:false,error:"D1 binding DB is not configured"},500);
    try {
      try { await env.DB.prepare("ALTER TABLE products ADD COLUMN subcategory TEXT").run(); } catch (e) {}
      if (url.pathname === "/api/health" && request.method === "GET") {
        await env.DB.prepare("SELECT 1").first();
        return json({ok:true,service:"Affiliate Hunter AI API",database:"connected"});
      }
      if (url.pathname === "/api/product-image" && request.method === "GET") {
        const raw=url.searchParams.get("url")||"";
        let target;
        try { target=new URL(raw); } catch { return json({ok:false,error:"URL produk tidak sah"},400); }
        const allowed=h=>h==="shopee.com.my"||h.endsWith(".shopee.com.my");
        if(target.protocol!=="https:"||!allowed(target.hostname)) return json({ok:false,error:"Hanya URL Shopee Malaysia dibenarkan"},400);
        const page=await fetch(target.toString(),{headers:{"User-Agent":"Mozilla/5.0 (compatible; AffiliateHunterAI/1.0)","Accept":"text/html,application/xhtml+xml"},redirect:"follow"});
        const finalUrl=new URL(page.url);
        if(!allowed(finalUrl.hostname)) return json({ok:false,error:"Pautan dialihkan ke domain yang tidak dibenarkan"},400);
        if(!page.ok) return json({ok:false,error:"Shopee tidak membenarkan halaman ini diakses sekarang (HTTP "+page.status+"). Masukkan URL gambar secara manual."},502);
        const html=(await page.text()).slice(0,1500000);
        const meta=(property)=>{const re=new RegExp('<meta[^>]+(?:property|name)=["\\']'+property+'["\\'][^>]+content=["\\']([^"\\']+)["\\']','i');const m=html.match(re);return m?m[1].replace(/&amp;/g,"&").replace(/&quot;/g,'"'):null;};
        const image=meta("og:image")||meta("twitter:image");
        const title=meta("og:title")||meta("twitter:title");
        if(!image) return json({ok:false,error:"Imej tidak ditemui pada halaman Shopee ini. Shopee mungkin menyekat preview; masukkan URL gambar secara manual."},404);
        let imageUrl;try{imageUrl=new URL(image,finalUrl).toString()}catch{return json({ok:false,error:"URL imej daripada halaman tidak sah"},502)}
        if(!imageUrl.startsWith("https://")) return json({ok:false,error:"URL imej tidak selamat"},502);
        return json({ok:true,image_url:imageUrl,title,source:finalUrl.toString()});
      }
      if (url.pathname === "/api/products" && request.method === "GET") {
        const q=(url.searchParams.get("q")||"").trim();
        const category=(url.searchParams.get("category")||"").trim();
        const limit=Math.min(Math.max(Number(url.searchParams.get("limit")||100),1),10000);
        let sql="SELECT * FROM products WHERE 1=1";
        const params=[];
        if(q){sql+=" AND (name LIKE ? OR category LIKE ?)";params.push("%"+q+"%","%"+q+"%");}
        if(category){sql+=" AND category = ?";params.push(category);}
        sql+=" ORDER BY created_at DESC LIMIT ?";
        params.push(limit);
        const result=await env.DB.prepare(sql).bind(...params).all();
        return json({ok:true,products:result.results||[]});
      }
      if (url.pathname === "/api/products" && request.method === "POST") {
        const body=await request.json();
        const name=String(body.name||"").trim();
        if(!name) return json({ok:false,error:"Product name is required"},400);
        const fields={
          category:String(body.category||"Other").slice(0,80),
          subcategory:body.subcategory?String(body.subcategory).slice(0,100):null,
          price:body.price==null?null:Number(body.price),
          commission_rate:body.commission_rate==null?null:Number(body.commission_rate),
          rating:body.rating==null?null:Number(body.rating),
          sold_count:body.sold_count==null?null:Number(body.sold_count),
          image_url:body.image_url?String(body.image_url).slice(0,2000):null,
          product_url:body.product_url?String(body.product_url).slice(0,2000):null,
          affiliate_url:body.affiliate_url?String(body.affiliate_url).slice(0,2000):null,
          notes:body.notes?String(body.notes).slice(0,2000):null
        };
        const result=await env.DB.prepare(
          "INSERT INTO products (name,category,subcategory,price,commission_rate,rating,sold_count,image_url,product_url,affiliate_url,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
        ).bind(name,fields.category,fields.subcategory,fields.price,fields.commission_rate,fields.rating,fields.sold_count,fields.image_url,fields.product_url,fields.affiliate_url,fields.notes).run();
        return json({ok:true,id:result.meta.last_row_id},201);
      }
      if (url.pathname.startsWith("/api/products/") && request.method === "PUT") {
        const id=Number(url.pathname.split("/").pop());
        if(!Number.isInteger(id)||id<1) return json({ok:false,error:"Invalid product id"},400);
        const body=await request.json();
        const sets=[],values=[];
        if(Object.prototype.hasOwnProperty.call(body,"image_url")){sets.push("image_url=?");values.push(body.image_url?String(body.image_url).slice(0,2000):null)}
        if(Object.prototype.hasOwnProperty.call(body,"category")){sets.push("category=?");values.push(String(body.category||"Other").slice(0,80))}
        if(Object.prototype.hasOwnProperty.call(body,"subcategory")){sets.push("subcategory=?");values.push(body.subcategory?String(body.subcategory).slice(0,100):null)}
        if(!sets.length)return json({ok:false,error:"No fields to update"},400);
        values.push(id);
        const result=await env.DB.prepare("UPDATE products SET "+sets.join(",")+" WHERE id=?").bind(...values).run();
        return json({ok:true,changes:result.meta.changes||0});
      }
      if (url.pathname.startsWith("/api/products/") && request.method === "DELETE") {
        const id=Number(url.pathname.split("/").pop());
        if(!Number.isInteger(id)||id<1) return json({ok:false,error:"Invalid product id"},400);
        await env.DB.prepare("DELETE FROM products WHERE id=?").bind(id).run();
        return json({ok:true});
      }
      return json({ok:false,error:"Not found"},404);
    } catch (error) {
      return json({ok:false,error:"Server error",detail:String(error.message||error)},500);
    }
  }
};