using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;

namespace AfcQbAgent;

public static class JsonElementExtensions
{
    public static object? ToDotNetObject(this JsonElement el)
    {
        switch (el.ValueKind)
        {
            case JsonValueKind.Object:
                {
                    var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                    foreach (var prop in el.EnumerateObject())
                        dict[prop.Name] = prop.Value.ToDotNetObject();
                    return dict;
                }

            case JsonValueKind.Array:
                {
                    var list = new List<object?>();
                    foreach (var item in el.EnumerateArray())
                        list.Add(item.ToDotNetObject());
                    return list;
                }

            case JsonValueKind.String:
                return el.GetString();

            case JsonValueKind.Number:
                // Prefer decimal for money/qty. If it doesn't fit, fall back to double.
                if (el.TryGetDecimal(out var dec)) return dec;
                if (el.TryGetInt64(out var l)) return l;
                return el.GetDouble();

            case JsonValueKind.True:
                return true;

            case JsonValueKind.False:
                return false;

            case JsonValueKind.Null:
            case JsonValueKind.Undefined:
                return null;

            default:
                return el.ToString();
        }
    }

    public static object? NormalizeUnknown(object? obj)
    {
        if (obj is JsonElement je) return je.ToDotNetObject();
        return obj;
    }

    public static Dictionary<string, object?> NormalizeToDict(object? obj)
    {
        obj = NormalizeUnknown(obj);

        if (obj is Dictionary<string, object?> d1) return d1;

        // Sometimes you may get Dictionary<string, object>
        if (obj is Dictionary<string, object> d2)
        {
            var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in d2) dict[kv.Key] = kv.Value;
            return dict;
        }

        throw new ArgumentException("Expected an object/dictionary.");
    }

    public static List<object?> NormalizeToList(object? obj)
    {
        obj = NormalizeUnknown(obj);

        if (obj is List<object?> l1) return l1;

        if (obj is List<object> l2)
        {
            var list = new List<object?>(l2.Count);
            foreach (var x in l2) list.Add(x);
            return list;
        }

        if (obj is object[] arr)
            return new List<object?>(arr);

        throw new ArgumentException("Expected an array/list.");
    }
}
