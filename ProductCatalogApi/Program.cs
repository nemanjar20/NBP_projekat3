using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using MongoDB.Driver;
using DotNetEnv;


var builder = WebApplication.CreateBuilder(args);

// bind MongoDB settings
builder.Services.Configure<MongoDbSettings>(
    builder.Configuration.GetSection("MongoDb"));

// mongoDB klijent kao singleton
builder.Services.AddSingleton<IMongoClient>(sp =>
{
    var settings = sp.GetRequiredService<IOptions<MongoDbSettings>>().Value;
    return new MongoClient(settings.ConnectionString);
});


// registrujemo kolekciju
builder.Services.AddSingleton<IMongoCollection<BsonDocument>>(sp =>
{
    var client   = sp.GetRequiredService<IMongoClient>();
    var settings = sp.GetRequiredService<IOptions<MongoDbSettings>>().Value;
    var database = client.GetDatabase(settings.DatabaseName);
    var collection = database.GetCollection<BsonDocument>(settings.CollectionName);


    return collection;
});

// dodajemo poseban singleton servis koji ce uraditi inicijalizaciju (indeksi + validacija) na startu aplikacije
builder.Services.AddSingleton<IHostedService, MongoDbInitializer>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()     
               .AllowAnyMethod()    
               .AllowAnyHeader();
    });
});

var app = builder.Build();

app.UseHttpsRedirection();
app.UseCors("AllowAll");


// serviranje statickih fajlova iz wwwroot foldera
app.UseStaticFiles();

app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/styles.css"))
    {
        Console.WriteLine("Zahtev za styles.css stigao!");
    }
    await next(context);
});

// da root (/) automatski servira index.html
app.MapFallbackToFile("index.html");


// --------------------- API rute ---------------------

// GET /products => svi proizvodi

app.MapGet("/products", async (IMongoCollection<BsonDocument> collection) => // kreira HTTP GET rutu na putanji /products
{
    var filter = Builders<BsonDocument>.Filter.Empty; // kreira prazan filter =>  uzima sve dokumente iz kolekcije
    var products = await collection.Find(filter).ToListAsync(); // Find() trazi dokumente po filteru. ToListAsync() vraca sve rezultate kao List<BsonDocument>

    // rucno u JSON string 
    var json = products.ToJson(new JsonWriterSettings { Indent = true }); // pretvaranje liste BsonDocument-a u JSON string

    return Results.Content(json, "application/json");
});



// POST /products => dodaj proizvod (bilo koji JSON => BsonDocument)
app.MapPost("/products", async (HttpContext context, IMongoCollection<BsonDocument> collection) =>
{
    using var reader = new StreamReader(context.Request.Body); // kreira citac koji otvara strim tela HTTP zahteva
    var json = await reader.ReadToEndAsync(); // cita sav tekst iz tela zahteva i smesta ga u json

    if (string.IsNullOrWhiteSpace(json))
        return Results.BadRequest("Prazno telo zahteva");

    try
    {
        var document = BsonDocument.Parse(json); // parsira u BsonDocument
        
        // ako dokument nema polje "createdAt", dodaje ga sa trenutnim vremenom u UTC formatu
        if (!document.Contains("createdAt"))
            document["createdAt"] = DateTime.UtcNow;

        // upisuje dokument u MongoDB
        await collection.InsertOneAsync(document);

        // umesto da vracamo ceo document, vratimo samo Created sa ID-om
        var id = document["_id"].ToString();
        return Results.Created($"/products/{id}", new { id = id, message = "Proizvod uspesno dodat" });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Greska pri dodavanju: {ex.Message}");
        return Results.BadRequest($"Nevalidan JSON ili greska pri cuvanju: {ex.Message}");
    }
});

// DELETE /products/{id} => obrisi proizvod po ID
app.MapDelete("/products/{id}", async (string id, IMongoCollection<BsonDocument> collection) =>
{
    try
    {
        var objectId = new ObjectId(id); // konvertuje string iz URL-a u ObjectId koji MongoDB koristi za kljuceve
        var filter = Builders<BsonDocument>.Filter.Eq("_id", objectId); // trazenje dokumenta cije je polje _id jednako objectId
        var result = await collection.DeleteOneAsync(filter); // salje se zahtev bazi da obrise dokument koji ispunjava uslov iz filtera

        if (result.DeletedCount == 0)
            return Results.NotFound("Proizvod nije pronadjen");

        return Results.Ok("Proizvod obrisan");
    }
    catch
    {
        return Results.BadRequest("Nevalidan ID");
    }
});

// PUT /products/{id} => azuriraj proizvod
app.MapPut("/products/{id}", async (string id, HttpContext context, IMongoCollection<BsonDocument> collection) =>
{
    try
    {
        var objectId = new ObjectId(id); // konvertuje string iz URL-a u ObjectId koji MongoDB koristi za kljuceve

        using var reader = new StreamReader(context.Request.Body);
        var json = await reader.ReadToEndAsync(); // otvara strim za citanje tela HTTP zahteva.

        if (string.IsNullOrWhiteSpace(json))
            return Results.BadRequest("Prazno telo zahteva");

        var updatedDocument = BsonDocument.Parse(json); // pretvara JSON u BsonDocument

        updatedDocument.Remove("_id"); 

        var filter = Builders<BsonDocument>.Filter.Eq("_id", objectId); // pronadji dokument ciji je _id jednak onom iz URL-a
        var update = new BsonDocument("$set", updatedDocument); // $set kaze bazi da azurira samo polja koja su poslata

        var result = await collection.UpdateOneAsync(filter, update); // salje se zahtev bazi da azurira dokument koji ispunjava uslov iz filtera

        if (result.ModifiedCount == 0)
            return Results.NotFound("Proizvod nije pronadjen ili nema promena");

        return Results.Ok("Proizvod uspesno azuriran");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Greska pri azuriranju: {ex.Message}");
        return Results.BadRequest($"Greska: {ex.Message}");
    }
});


app.Run();




