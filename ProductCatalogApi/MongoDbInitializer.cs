using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

public class MongoDbInitializer : IHostedService
{
    private readonly IMongoCollection<BsonDocument> _collection;
    private readonly MongoDbSettings _settings;

    public MongoDbInitializer(
        IMongoCollection<BsonDocument> collection,
        IOptions<MongoDbSettings> settings)
    {
        _collection = collection;
        _settings   = settings.Value;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var database = _collection.Database;

        // ── validacija seme ────────────────────────────────────────
        try
        {
            var schema = BsonDocument.Parse(@"
            {
                bsonType: 'object',
                required: ['name', 'price', 'type'],
                properties: {
                    name:   { bsonType: 'string', minLength: 3 },
                    price:  { bsonType: ['double', 'int'], minimum: 0 },
                    type:   { bsonType: 'string', minLength: 2 },
                    imageUrl: { bsonType: ['string', 'null'] }
                },
                additionalProperties: true
            }");

            await database.CreateCollectionAsync(
                _settings.CollectionName,
                new CreateCollectionOptions<BsonDocument>
                {
                    Validator = new BsonDocument("$jsonSchema", schema)
                },
                cancellationToken);
        }
        catch (MongoCommandException ex) when (ex.Code == 48) // already exists
        {
            // kolekcija vec postoji
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Greška pri kreiranju kolekcije/validacije: {ex.Message}");
        }

        // ── KREIRANJE INDEKSA ────────────────────────────────────────
        // izvrsava se svaki put kad aplikacija startuje
        try
        {
            // text index => omogucava $text pretragu po vise polja
            await _collection.Indexes.CreateOneAsync(
                new CreateIndexModel<BsonDocument>(
                    Builders<BsonDocument>.IndexKeys
                        .Text("name")
                        .Text("type")                 
                        ,
                    new CreateIndexOptions
                    {
                        Name = "text_name_type",
                        
                    }));

            // compound index => za filter po tipu + sortiranje po ceni
            await _collection.Indexes.CreateOneAsync(
                new CreateIndexModel<BsonDocument>(
                    Builders<BsonDocument>.IndexKeys
                        .Ascending("type")
                        .Descending("price"),
                    new CreateIndexOptions
                    {
                        Name = "type_price_desc"
                    }));

            Console.WriteLine("Indeksi uspešno kreirani ili već postoje.");
        }
        catch (MongoCommandException ex) when (ex.Code == 85 || ex.Code == 11000)
        {
            // 85 = index options conflict, 11000 = duplicate key (unique)
            // indeks već postoji
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Greška pri kreiranju indeksa: {ex.Message}");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}